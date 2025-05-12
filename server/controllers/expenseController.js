import Trip from '../models/tripModel.js';
import Expense from '../models/expenseModel.js';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getExpenses = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user._id;

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    const expenses = await Expense.find({ trip: tripId })
      .sort({ date: -1 })
      .populate('createdBy', 'username email');

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const addExpense = async (req, res) => {
  try {
    const { description, amount, date, paidBy, splitType, splitWith } = req.body;
    const tripId = req.params.id;
    const userId = req.user._id;

    if (!description || !amount || !paidBy || !splitWith || splitWith.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify the user is a participant in this trip
    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    // Verify that paidBy and all splitWith emails are trip participants
    const validEmails = trip.participants
      .filter(p => p.status === 'accepted')
      .map(p => p.email);

    if (!validEmails.includes(paidBy)) {
      return res.status(400).json({
        success: false,
        message: 'The payer must be a trip participant'
      });
    }

    for (const split of splitWith) {
      if (!validEmails.includes(split.email)) {
        return res.status(400).json({
          success: false,
          message: `${split.email} is not a trip participant`
        });
      }
    }

    // Create the expense
    const expense = await Expense.create({
      description,
      amount: parseFloat(amount),
      date: date || new Date(),
      trip: tripId,
      paidBy,
      splitType,
      splitWith,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Utility function to escape HTML special characters
const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const exportExpensesPdf = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user._id;

    // Verify the user is a participant in this trip
    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    }).populate('participants.user', 'email');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    // Get all expenses for this trip
    const expenses = await Expense.find({ trip: tripId })
      .sort({ date: -1 })
      .populate('createdBy', 'username email');

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set up the response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=TripExpenses_${trip.name.replace(/\s+/g, '_')}.pdf`);
    
    // Pipe the PDF directly to the response
    doc.pipe(res);
    
    // Add document title
    doc.fontSize(25).text(`${trip.name} - Expense Summary`, { align: 'center' });
    doc.moveDown();
    
    // Add trip details
    doc.fontSize(14).text(`Trip Duration: ${format(new Date(trip.startDate), 'MMM dd, yyyy')} - ${format(new Date(trip.endDate), 'MMM dd, yyyy')}`);
    doc.moveDown();
    
    // Add expense list
    doc.fontSize(18).text('Expenses', { underline: true });
    doc.moveDown();
    
    // Table header
    const tableTop = doc.y;
    const columnWidths = {
      date: 80,
      description: 180,
      amount: 80,
      paidBy: 150
    };
    
    doc.fontSize(12);
    doc.text('Date', { width: columnWidths.date });
    doc.moveUp();
    doc.text('Description', { width: columnWidths.description, continued: false, align: 'left' }, tableTop, doc.x + columnWidths.date);
    doc.moveUp();
    doc.text('Amount', { width: columnWidths.amount, continued: false, align: 'right' }, tableTop, doc.x + columnWidths.date + columnWidths.description);
    doc.moveUp();
    doc.text('Paid By', { width: columnWidths.paidBy, continued: false, align: 'left' }, tableTop, doc.x + columnWidths.date + columnWidths.description + columnWidths.amount);
    doc.moveDown();
    
    // Table separator line
    doc.moveTo(doc.x, doc.y)
      .lineTo(doc.x + columnWidths.date + columnWidths.description + columnWidths.amount + columnWidths.paidBy, doc.y)
      .stroke();
    doc.moveDown();
    
    // Table rows
    let totalAmount = 0;
    expenses.forEach(expense => {
      const rowTop = doc.y;
      totalAmount += expense.amount;
      
      doc.text(format(new Date(expense.date), 'MM/dd/yyyy'), { width: columnWidths.date });
      doc.moveUp();
      doc.text(expense.description, { width: columnWidths.description, continued: false, align: 'left' }, rowTop, doc.x + columnWidths.date);
      doc.moveUp();
      doc.text(`$${expense.amount.toFixed(2)}`, { width: columnWidths.amount, continued: false, align: 'right' }, rowTop, doc.x + columnWidths.date + columnWidths.description);
      doc.moveUp();
      doc.text(expense.paidBy, { width: columnWidths.paidBy, continued: false, align: 'left' }, rowTop, doc.x + columnWidths.date + columnWidths.description + columnWidths.amount);
      doc.moveDown();
    });
    
    // Table separator line
    doc.moveTo(doc.x, doc.y)
      .lineTo(doc.x + columnWidths.date + columnWidths.description + columnWidths.amount + columnWidths.paidBy, doc.y)
      .stroke();
    doc.moveDown();
    
    // Total amount
    doc.text(`Total: $${totalAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);
    
    // Add a section for participant balances
    doc.fontSize(18).text('Balance Summary', { underline: true });
    doc.moveDown();
    
    // Calculate balances
    const balances = {};
    
    // Initialize balances for all participants
    trip.participants.forEach(participant => {
      if (participant.user && participant.user.email) {
        balances[participant.user.email] = { owes: {}, owed: {}, total: 0 };
      }
    });
    
    // Calculate balances based on expenses
    expenses.forEach(expense => {
      const payer = expense.paidBy;
      
      expense.splitWith.forEach(split => {
        const participant = split.email;
        const amountOwed = split.amount;
        
        if (participant !== payer) {
          // Add to what this person owes the payer
          if (!balances[participant].owes[payer]) {
            balances[participant].owes[payer] = 0;
          }
          balances[participant].owes[payer] += amountOwed;
          
          // Add to what the payer is owed by this person
          if (!balances[payer].owed[participant]) {
            balances[payer].owed[participant] = 0;
          }
          balances[payer].owed[participant] += amountOwed;
        }
      });
    });
    
    // Calculate net balances
    trip.participants.forEach(participant => {
      if (participant.user && participant.user.email) {
        const email = participant.user.email;
        let totalOwed = 0;
        let totalOwes = 0;
        
        // Sum up all that this person is owed
        Object.values(balances[email].owed).forEach(amount => {
          totalOwed += amount;
        });
        
        // Sum up all that this person owes
        Object.values(balances[email].owes).forEach(amount => {
          totalOwes += amount;
        });
        
        balances[email].total = totalOwed - totalOwes;
      }
    });
    
    // Display balances in the PDF
    trip.participants.forEach(participant => {
      if (participant.user && participant.user.email) {
        const email = participant.user.email;
        const balance = balances[email].total;
        
        let status;
        if (balance > 0) {
          status = `Gets back $${balance.toFixed(2)}`;
          doc.fillColor('green');
        } else if (balance < 0) {
          status = `Owes $${Math.abs(balance).toFixed(2)}`;
          doc.fillColor('red');
        } else {
          status = 'Settled up';
          doc.fillColor('gray');
        }
        
        doc.fontSize(12).text(`${email}: ${status}`);
        doc.fillColor('black');
      }
    });
    
    // Add detailed breakdown if space allows
    if (expenses.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Detailed Balances', { underline: true });
      doc.moveDown();
      
      trip.participants.forEach(participant => {
        if (participant.user && participant.user.email) {
          const email = participant.user.email;
          const balance = balances[email];
          
          if (Object.keys(balance.owes).length > 0 || Object.keys(balance.owed).length > 0) {
            doc.fontSize(14).text(email);
            doc.moveDown(0.5);
            
            if (Object.keys(balance.owes).length > 0) {
              doc.fontSize(12).text('Owes:');
              Object.entries(balance.owes).forEach(([person, amount]) => {
                doc.fontSize(10).text(`  • ${person}: $${amount.toFixed(2)}`);
              });
              doc.moveDown(0.5);
            }
            
            if (Object.keys(balance.owed).length > 0) {
              doc.fontSize(12).text('Is owed by:');
              Object.entries(balance.owed).forEach(([person, amount]) => {
                doc.fontSize(10).text(`  • ${person}: $${amount.toFixed(2)}`);
              });
              doc.moveDown(0.5);
            }
            
            doc.moveDown();
          }
        }
      });
    }
    
    // Add footer
    doc.fontSize(10).text(`Generated by TripSync on ${format(new Date(), 'MMM dd, yyyy')}`, { align: 'center' });
    
    // Finalize the PDF
    doc.end();
    
  } catch (error) {
    console.error('Export expenses PDF error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 
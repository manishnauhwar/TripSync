package com.client

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "client"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
      
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Create notification channel for Android 8.0+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelId = "tripsync_default_channel"
      val channelName = "TripSync Notifications"
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      
      // Check if channel already exists
      val existingChannel = notificationManager.getNotificationChannel(channelId)
      if (existingChannel == null) {
        val channel = NotificationChannel(
          channelId,
          channelName,
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "TripSync notification channel"
          enableLights(true)
          lightColor = Color.RED
          enableVibration(true)
          vibrationPattern = longArrayOf(100, 200, 300, 400, 500, 400, 300, 200, 400)
          setShowBadge(true)
        }
        notificationManager.createNotificationChannel(channel)
        println("Created notification channel: $channelId")
      } else {
        println("Notification channel already exists: $channelId")
      }
    }
  }
}

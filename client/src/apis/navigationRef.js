import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    _queuedNavigationActions.push({ name, params });
  }
}
const _queuedNavigationActions = [];

export function processQueuedNavigationActions() {
  if (!navigationRef.isReady()) return;
  
  while (_queuedNavigationActions.length > 0) {
    const { name, params } = _queuedNavigationActions.shift();
    navigate(name, params);
  }
}

export default { navigate, navigationRef, processQueuedNavigationActions }; 
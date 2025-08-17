import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('WebPConverter', () => App);
AppRegistry.runApplication('WebPConverter', {
  rootTag: document.getElementById('root')
});

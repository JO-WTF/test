import { createApp } from 'vue';
// 按需导入 Ant Design Vue 组件以减小 bundle 大小
import {
  Select,
  Input,
  DatePicker,
  Radio,
  RadioGroup,
  RadioButton,
} from 'ant-design-vue';
import Viewer from 'v-viewer';
import App from './App.vue';
import router from './router';

import 'viewerjs/dist/viewer.css';
import 'ant-design-vue/dist/reset.css';
import 'toastify-js/src/toastify.css';
import './assets/css/styles.css';

const app = createApp(App);
app.use(router);

// 按需注册 Ant Design 组件
app.use(Select);
app.use(Input);
app.use(DatePicker);
app.use(Radio);
app.use(RadioGroup);
app.use(RadioButton);

app.use(Viewer);
app.mount('#app');

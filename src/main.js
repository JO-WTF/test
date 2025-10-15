import { createApp } from 'vue';
// 按需导入 Ant Design Vue 组件以减小 bundle 大小
import {
  Select,
  Table,
  Input,
  DatePicker,
  Spin,
  Radio,
  RadioGroup,
  RadioButton,
  Modal,
  Card,
  Button,
  Alert,
  Space,
  Form,
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
app.use(Table);
app.use(Input);
app.use(DatePicker);
app.use(Spin);
app.use(Radio);
app.use(RadioGroup);
app.use(RadioButton);
app.use(Modal);
app.use(Card);
app.use(Button);
app.use(Alert);
app.use(Space);
app.use(Form);

app.use(Viewer);
app.mount('#app');

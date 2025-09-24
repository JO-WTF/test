import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';
import router from './router';

import 'ant-design-vue/dist/reset.css';
import 'toastify-js/src/toastify.css';
import './assets/css/styles.css';

const app = createApp(App);
app.use(router);
app.use(Antd);
app.mount('#app');

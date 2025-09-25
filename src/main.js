import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import Viewer from 'v-viewer';
import App from './App.vue';
import router from './router';

import 'viewerjs/dist/viewer.css';
import 'ant-design-vue/dist/reset.css';
import 'toastify-js/src/toastify.css';
import './assets/css/styles.css';

const app = createApp(App);
app.use(router);
app.use(Antd);
app.use(Viewer);
app.mount('#app');

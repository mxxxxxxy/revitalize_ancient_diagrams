import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
// import router from './router'
import * as d3 from 'd3';
import * as Konva from 'Konva'
window.Konva = Konva;
window.d3 = d3;

const app = createApp(App)

app.use(createPinia())
// app.use(router)

app.mount('#app')

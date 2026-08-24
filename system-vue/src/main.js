/**
 * Ponto de entrada da aplicação Vue.
 * Monta o componente raiz App.vue no <div id="app"> do index.html.
 */
import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'

createApp(App).mount('#app')

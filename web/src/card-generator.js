import './app.css'
import { mount } from 'svelte'
import CardGenerator from './lib/CardGenerator.svelte'

const app = mount(CardGenerator, {
  target: document.getElementById('app'),
})

export default app

import Modal from '../Modal.vue'
import { createVNode, render } from 'vue'
export default {
  install: (app) => {
    const container = document.createElement("div")
    container.style.overflow = 'auto'
    document.body.appendChild(container)

    const vnode = createVNode(Modal)
    vnode.appContext = app._context
    render(vnode, container)  
  }
}
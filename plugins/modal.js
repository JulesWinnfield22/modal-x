import Modal from '../Modal.vue'
import { createVNode, render } from 'vue'
import { setModalConfig } from '../store/modal.js'
export default {
  install: (app, options = {}) => {
    // Library-wide defaults (e.g. { onDoubleBack: 'stay' }). Overridable per
    // modal via openModal(..., options).
    setModalConfig(options)

    const container = document.createElement("div")
    container.style.overflow = 'auto'
    document.body.appendChild(container)

    const vnode = createVNode(Modal)
    vnode.appContext = app._context
    render(vnode, container)
  }
}
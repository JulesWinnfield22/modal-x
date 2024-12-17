import ModalParent from "./ModalParent.vue";
import { useModal, onHide, modalOptions, onShow } from "./store/modal";
import modal from './plugins/modal';
/**
 * Opens a modal component.
 *
 * @param {string} modalToOpen - The identifier(name of the modal file) of the modal component to open.
 * @param {Object} [data] - Optional data to pass to the modal component.
 * @param {Function} [cb] - Optional callback function to be executed after the modal is closed.
 * @returns {void}
 */
function openModal(modalToOpen, data, cb) {
  const { openModal: OM } = useModal();
  OM(modalToOpen, data, cb);
}

/**
 * Closes an open modal component.
 *
 * @param {*} [response] - Optional response data to send back from the modal.
 * @param {boolean} [sendResponse=true] - Optional flag to determine whether to send the response data. Defaults to true.
 * @returns {void}
 */
function closeModal(response = false, sendResponse = true) {
  const { closeModal: CM } = useModal();
  CM(response, sendResponse);
}

/**
 * Retrieves a modal component instance by its name.
 *
 * @param {string} name - The name or identifier of the modal component to retrieve.
 * @returns {any} - The instance of the modal component identified by the name.
 */
function getModal(name) {
  const { getModal: GM } = useModal();
  return GM(name);
}

/**
 * Loads a modal component.
 *
 * @param {Object} modal - The modal component to load. Can be a Vue instance Component.
 * @returns {void}
 */
function loadModal(modal) {
  const { loadModal: LM } = useModal();
  LM(modal);
}

/**
 * Provides functions and components for managing modals in your application.
 *
 * @module modals
 *
 * @exports useModal - A composable for interacting with modals.
 * @exports getModal - Retrieves a modal component instance by its name.
 * @exports openModal - Opens a modal component with options for data and callbacks.
 * @exports loadModal - Loads a modal component with a configuration or an instance.
 * @exports closeModal - Closes an open modal with options for sending response data.
 * @exports ModalParent - A modal wrapper serving as the container for modal components.
 */
export { onShow, onHide, useModal, getModal, openModal, loadModal, closeModal, ModalParent, modalOptions, modal as default };
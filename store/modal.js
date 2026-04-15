import {
  reactive,
  shallowRef,
  watch,
  defineAsyncComponent,
  nextTick,
  h,
  ref,
} from "vue";
import ModalParent from '../ModalParent.vue'
import Spinner from "../Spinner.vue";

// ── Global Singleton State ──
// We use globalThis to ensure that even if the library is imported through different paths
// (e.g., source vs bundled, or relative vs node_modules), there is only ONE reactive state.
const STORE_KEY = "__MODAL_X_STORE__";

if (!globalThis[STORE_KEY]) {
  globalThis[STORE_KEY] = {
    modals: reactive([]),
    fetchedModals: shallowRef([]),
    spinners: shallowRef([]),
    globalSpinner: shallowRef(),
    modalName: ref(""),
  };
}

const {
  modals,
  fetchedModals,
  spinners,
  globalSpinner,
  modalName,
} = globalThis[STORE_KEY];

/**
 * Opens a modal and returns a Promise that resolves when it is closed.
 * Backward-compatible: an optional callback (3rd arg) is still supported.
 *
 * @param {string} modalToOpen - Modal file name (without extension).
 * @param {*} [data] - Data to pass to the modal component.
 * @param {Function} [cb] - Legacy callback (still supported for backward compat).
 * @param {object} [options] - Modal options (closeonEsc, closeOnOverlayClick).
 * @returns {Promise<any>} Resolves with the value passed to closeModal().
 */
function openModal(modalToOpen, data, cb, options) {
  return new Promise((resolve) => {
    modals.forEach((modal) => {
      modal.active = false;
    });

    modals.unshift({
      id: Math.random().toString(36).substring(2, 9),
      modalToOpen,
      data,
      cb,           // keep legacy callback support
      _resolve: resolve,  // Promise resolve
      active: true,
      options,
    });
  });
}

/**
 * Closes the topmost modal.
 *
 * @param {*} [response] - Data to return to the opener.
 * @param {boolean} [sendResponse=true] - If false, resolves with undefined.
 */
function closeModal(response, sendResponse = true) {
  let modal = modals.shift();
  if (!modal) return;

  modals.length && (modals[0].active = true);

  // Resolve the Promise (always resolve to avoid hanging)
  if (modal._resolve) {
    modal._resolve(sendResponse ? response : undefined);
  }

  // Legacy callback support
  if (sendResponse && ![undefined, null].includes(response) && modal.cb) {
    modal.cb(response);
  }
}

function getModal(name) {
  return modals.find((modal) => modal.modalToOpen == name);
}

async function loadModal(modal, name, render = true) {
  if (
    fetchedModals.value.find((mod) =>
      [name, modal.__name?.match(/.*\/(.+)\.(amdl|mdl)\.vue$/)?.[1]].includes(mod.id)
    )
  ) {
    return;
  }

  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }
  fetchedModals.value = [
    {
      id: name || "",
      modal: h(ModalParent, {
        name
      }, () => {
        return h(com, {
          data: getModal(name)?.data,
          close: (res) => closeModal(res),
          ...(`${getModal(name)?.data}` == "[object Object]" ? getModal(name)?.data : {})
        })
      }),
    },
    ...fetchedModals.value,
  ];
}

async function loadSpinners(modal, name, group, render = true) {
  if (
    spinners.value.find((mod) => {
      return [name, modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1]?.split('.')?.[0]].includes(
        mod.id
      );
    })
  )
    return;
  
  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }

  spinners.value = [
    {
      id: name || modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1] || "",
      modal: com,
      group
    },
    ...spinners.value,
  ];
}

async function loadGlobalSpinner(modal, name, render = true) {
  let com;
  if (render) {
    com = await modal.__asyncLoader();
  } else {
    com = modal;
  }
  globalSpinner.value = {
    id: name || modal.__name?.match(/.*\/(.+)\.g\.vue$/)?.[1] || "",
    modal: com,
  };
}

function fetchModal(name) {
  if (
    fetchedModals.value.find(
      (modal) => modal.id == `${name}.mdl` || modal.id == name
    )
  )
    return;

  const asyncModules = import.meta.glob([
    '/**/*.amdl.vue',
    '/**/*.mdl.vue',
    '!**/node_modules/**',
  ]);

  let mods = { ...asyncModules };

  let group;
  const modalPath = Object.keys(mods).find((module) => {
    const filename = module.split('/').pop();
    const nameParts = filename.replace(/\.(amdl|mdl)\.vue$/, '').split('.');
    const fileName = nameParts[0];

    if (fileName === name) {
      group = nameParts[1]; // Extract group if it exists (e.g. AddUser.user.amdl.vue)
      return true;
    }
    return false;
  });

  if (!modalPath)
    return console.log(
      `%cno modal found with name [${name}]`,
      "font-size: 14px; color: red;"
    );

  const spinnerModal = spinners.value.find((m) => m.id == name || (group && m?.group == group))?.modal;
  let modal = defineAsyncComponent({
    loader: () => mods[modalPath](),
    loadingComponent: spinnerModal || globalSpinner.value?.modal || Spinner,
    delay: 0,
  });

  loadModal(modal, name, false);
}

watch(modals, (modals) => {
  if(modals?.[0]) fetchModal(modals?.[0]?.modalToOpen);
});

/**
 * Composable that returns all modal state and actions.
 * Drop-in replacement for the old Pinia-based useModal().
 */
export function useModal() {
  return {
    modals,
    loadSpinners,
    spinners,
    fetchedModals,
    openModal,
    closeModal,
    getModal,
    loadModal,
    loadGlobalSpinner,
    modalName,
  };
}

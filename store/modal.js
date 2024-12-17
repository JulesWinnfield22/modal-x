import {
  reactive,
  shallowRef,
  watch,
  defineAsyncComponent,
  getCurrentInstance,
  nextTick,
  h,
  ref,
} from "vue";
import ModalParent from '../ModalParent.vue'
import { defineStore } from "pinia";
import Spinner from "../Spinner.vue";

const onShowHooks = [];
const onHideHooks = [];
const options = ref({});

function modalOptions(option) {
  const fileName = getCurrentInstance()?.type?.__name?.split(".")?.[0];
  
  options.value = {
    ...options.value,
    [fileName]: option
  }

  return new Proxy(options.value[fileName], {
    set(_, el, val) {
      options.value[fileName] = {
        [el]: val
      }
      return options.value[fileName]
    }
  })
}

function onShow(cb) {
  if (typeof cb != "function") {
    console.warn(
      "function %[onShow] expects a function as the first arguments",
      "color: red"
    );
  }

  const fileName = getCurrentInstance()?.type?.__name?.split(".")?.[0];
  if (onShowHooks.find((el) => el.name == fileName)) return;
  onShowHooks.push({
    name: fileName,
    hook: cb,
    called: false,
  });
}

function onHide(cb) {
  if (typeof cb != "function") {
    console.warn(
      "function %[onHide] expects a function as the first arguments",
      "color: red"
    );
  }

  const fileName = getCurrentInstance()?.type?.__name?.split(".")?.[0];
  if (onHideHooks.find((el) => el.name == fileName)) return;
  onHideHooks.push({
    name: fileName,
    hook: cb,
  });
}

function callHook(hook) {
  if (hook && typeof hook == "function") {
    hook();
  } else if (hook) {
    console.error("Hook functions first argument not a function");
  }
}

export { onShow, onHide, modalOptions, options };

export const useModal = defineStore("modal", () => {
  let modals = reactive([]);
  const fetchedModals = shallowRef([]);
  const spinners = shallowRef([]);
  const globalSpinner = shallowRef();

  function openModal(modalToOpen, data, cb) {
    modals.forEach((modal) => {
      modal.active = false;
    });

    try {
      data = JSON.parse(JSON.stringify(data));
      modals.unshift({ modalToOpen, data, cb, active: true });
    } catch (err) {
      modals.unshift({ modalToOpen, data, cb, active: true });
    }
  }

  function closeModal(response, sendResponse = true) {
    let modal = modals[0];
    const found = onHideHooks.find((el) => el.name == modal?.modalToOpen);
    callHook(found?.hook);
    if (modals.length == 1) {
      const found = onShowHooks.find((el) => el.name == modal?.modalToOpen);
      found && (found.called = false);
    }
    modals.shift();
    modals.length && (modals[0].active = true);

    if (![undefined, null].includes(response)) modal.cb && modal.cb(response);
  }

  function getModal(name) {
    return modals.find((modal) => modal.modalToOpen == name);
  }

  async function loadModal(modal, name, render = true) {
    if (
      fetchedModals.value.find((mod) =>
        [name, modal.__name?.match(/.*\/(.+)\.mdl\.vue$/)?.[1]].includes(mod.id)
      )
    )
      return;

    let com;
    if (render) {
      com = await modal.__asyncLoader();
    } else {
      com = modal;
    }
    name ||= modal.__name?.match(/.*\/(.+)\.mdl\.vue$/)?.[1]
    fetchedModals.value = [
      {
        id: name || "",
        modal: h(ModalParent, {
          name
        }, () => {
          return h(com, {
            data: getModal(name)?.data
          })
        }),
      },
      ...fetchedModals.value,
    ];
  }

  async function loadSpinners(modal, name, group) {
    if (
      spinners.value.find((mod) => {
        return [name, modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1]?.split('.')?.[0]].includes(
          mod.id
        );
      })
    )
      return;
    const com = await modal.__asyncLoader();
    spinners.value = [
      {
        id: name || modal.__name?.match(/.*\/(.+)\.s\.vue$/)?.[1] || "",
        modal: com,
        group
      },
      ...spinners.value,
    ];
  }

  async function loadGlobalSpinner(modal, name) {
    const com = await modal.__asyncLoader();
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
      `/**/*(.)*.amdl.vue`,
      "!./node_modules",
    ]);
    let mods = { ...asyncModules };

    let group
    const modalPath = Object.keys(mods).find(
      (module) => {
        const file = module.match(/.*\/(.+)\.amdl\.vue$/)?.[1].split(".")
        const fileName = file?.[0] 
        if(fileName == name) {
          group = file?.[1]
        }
        return fileName == name
      }
    );

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
    if (modals?.[0]) fetchModal(modals?.[0]?.modalToOpen);
  });

  watch(
    modals,
    (newModals, oldModals) => {
      if (!newModals.length) return;
      const name = modals?.[0]?.modalToOpen;
      const found = onShowHooks.find((el) => el.name == name);
      found && !found.called && callHook(found?.hook);
    },
    {
      flush: "post",
    }
  );

  watch(
    modals,
    (newModals, oldModals) => {
      if (!newModals.length) return;
      const name = modals?.[1]?.modalToOpen;
      const found = onShowHooks.find((el) => el.name == name);
      found && (found.called = true);
    },
    {
      flush: "post",
    }
  );

  return {
    onShow,
    modals,
    loadSpinners,
    spinners,
    fetchedModals,
    openModal,
    closeModal,
    getModal,
    loadModal,
    loadGlobalSpinner,
    options
  };
});

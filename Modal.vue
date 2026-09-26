<script setup>
import { useModal } from "./store/modal";
import { installHistoryManager } from "./store/history.js";
import { installRouterHistory } from "./store/routerHistory.js";
import {
  watch,
  ref,
  onMounted,
  defineAsyncComponent,
  defineComponent,
  onUnmounted,
  nextTick,
  watchEffect,
} from "vue";
import { FileType } from "./enums";

import "./style.css";

function getFileType(file) {
  if (file.endsWith(".s.vue")) {
    return FileType.SPINNER;
  } else if (file.endsWith(".mdl.vue")) {
    return FileType.MODAL;
  } else if (file.endsWith(".g.vue")) {
    return FileType.GLOBAL_SPINNER;
  }
}

const { modals, getModal, loadModal, loadGlobalSpinner, loadSpinners, closeModal, getModalConfig } =
  useModal();

async function load(modules) {
  const paths = Object.keys(modules);
  
  paths.forEach((path) => {
    const file = path.split("/").pop();
    const type = getFileType(file);
    const nameParts = file.replace(/\.(mdl|s|g)\.vue$/, '').split('.');
    const name = nameParts[0];
    const group = type === FileType.SPINNER ? nameParts[1] : undefined;
    
    const component = modules[path].default || modules[path];

    if (type === FileType.MODAL) {
      loadModal(component, name, false);
    } else if (type === FileType.SPINNER) {
      loadSpinners(component, name, group, false);
    } else if (type === FileType.GLOBAL_SPINNER) {
      loadGlobalSpinner(component, name, false);
    }
  });
}

function loadAllModals() {
  const modules = import.meta.glob([
    '/**/*.mdl.vue',
    '/**/*.s.vue',
    '/**/*.g.vue',
    '!**/node_modules/**',
  ], { eager: true });
  
  load(modules);
}

const { fetchedModals } = useModal();

const showModal = ref(false);

watch(modals, (modals) => {
  if (!modals.length) return (showModal.value = false);

  showModal.value = true;
});

loadAllModals();

const firstFocusable = ref();
let firstFocusableElement;
let lastFocusableElement;

function tabListener(e) {
  let isTabPressed = e.key === "Tab" || e.keyCode === 9;

  if (!isTabPressed) {
    return;
  }

  if (e.shiftKey) {
    // if shift key pressed for shift + tab combination
    if (document.activeElement === firstFocusableElement) {
      lastFocusableElement.focus(); // add focus for the last focusable element
      e.preventDefault();
    }
  } else {
    // if tab key is pressed
    if (document.activeElement === lastFocusableElement) {
      // if focused has reached to last focusable element then focus first focusable element after pressing tab
      firstFocusableElement.focus(); // add focus for the first focusable element
      e.preventDefault();
    }
  }
}

function handleFocus() {
  // add all the elements inside modal which you want to make focusable
  const focusableElements =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const modal = document.querySelector("#__root_modal .__active.__modal"); // select the modal by it's id

  const els = modal?.querySelectorAll(focusableElements) || [];
  
  firstFocusableElement = els?.[0] || modal; // get first element to be focused inside modal

  const input = [...els].find((el) =>
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.nodeName)
  );

  lastFocusableElement = els[els.length - 1]; // get last element to be focused inside modal

  if (input) {
    input.focus();
  } else {
    firstFocusableElement?.focus();
  }
}

function watchMutation() {
  const observer = new MutationObserver(function (mutations) {
    handleFocus();
    observer.disconnect();
  });

  const observerConfig = { childList: true, subtree: true };
  observer.observe(firstFocusable.value, observerConfig);
}

watch(modals, handleFocus, { flush: "post" });
watch(
  fetchedModals,
  () => {
    const found = modals[0];
    if (
      found &&
      fetchedModals.value.find((el) => el.id == found?.modalToOpen)
    ) {
      watchMutation();
    }
  },
  { flush: "post" }
);

onMounted(() => {
  document.addEventListener("keydown", tabListener);
  const router = getModalConfig().router;
  if (router) {
    installRouterHistory(router, { modals, closeModal });
  } else {
    installHistoryManager({ modals, closeModal, getModalConfig });
  }
});

onUnmounted(() => {
  document.removeEventListener("keydown", tabListener);
});

let scroll = getComputedStyle(document.body)?.overflow;

watch(showModal, () => {
  if (showModal.value) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = scroll;
  }
});

</script>

<template>
  <div
    id="__root_modal"
    ref="firstFocusable"
    :class="[showModal ? '__block' : '__hidden']"
    class="__modal-parent"
  >
    <template v-for="{ id, modal } in fetchedModals" :key="id">
      <component v-if="modals?.length && getModal(id)" :is="modal" />
    </template>
  </div>
</template>

<script setup>
import { useModal, options } from "./store/modal";
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
import { storeToRefs } from "pinia";
import { FileType } from "./enums";

import "./style.css";
import { closeModal } from ".";

function getFileType(file) {
  if (file.endsWith(".s.vue")) {
    return FileType.SPINNER;
  } else if (file.endsWith(".mdl.vue")) {
    return FileType.MODAL;
  } else if (file.endsWith(".g.vue")) {
    return FileType.GLOBAL_SPINNER;
  }
}

const { modals, getModal, loadModal, loadGlobalSpinner, loadSpinners } =
  useModal();

async function load(modules) {
  let names = Object.keys(modules).map((name) => {
    const file = name.split("/").at(-1);
    const type = getFileType(file)
    
    return {
      name: file.split(".").at(0),
      type,
      group: type == FileType.SPINNER ? file.match(/(.+)\.s\.vue$/)?.[1]?.split('.')?.[1] : undefined
    };
  });

  const promise = Object.keys(modules).map((mdl) => {
    return defineAsyncComponent({
      loader: modules[mdl],
    });
  });

  const res = await Promise.all(promise);

  res.forEach(async (el, idx) => {
    if (names[idx].type == FileType.MODAL) {
      loadModal(el, names[idx].name);
    } else if (names[idx].type == FileType.SPINNER) {
      loadSpinners(el, names[idx].name, names[idx].group);
    } else if (names[idx].type == FileType.GLOBAL_SPINNER) {
      loadGlobalSpinner(el, names[idx].name);
    }
  });
}

function loadAllModals() {
  const modules = import.meta.glob([`/**/*.{mdl,s,g}.vue`, "!./node_modules"]);
  let mods = { ...modules };
  load(mods);
}

const { fetchedModals } = storeToRefs(useModal());

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
});

onUnmounted(() => {
  document.removeEventListener("keydown", tabListener);
});

function scrollHandler(ev) {
  console.log(ev, showModal.value);
  ev.preventDefault();
  if (showModal.value) {
  }
}

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
      <component v-bind="options[id]" v-if="modals?.length && getModal(id)" :is="modal" />
    </template>
  </div>
</template>

<script setup>
import { closeModal } from ".";
import { useModal } from "./store/modal.js";
import { watch, ref, getCurrentInstance, onMounted, onUnmounted } from "vue";

const props = defineProps({
  name: {
    type: String,
    default: "",
  },
});

const { modals, getModal, options } = useModal();
const name = props.name || (getCurrentInstance().parent?.type?.__name
? getCurrentInstance().parent.type.__name.split(".")[0]
: props.name)

const modal = ref();
watch(
  modals,
  (modals) => {
    modal.value = getModal(name);
  },
  { immediate: true }
);

function escListener(e) {
  if (e.key === "Escape" && modals?.length && options.value[name].autoClose) {
    closeModal();
  }
}

onMounted(() => {
  document.addEventListener("keydown", escListener);
})

onUnmounted(() => {
  document.removeEventListener("keydown", escListener);
});
</script>
<template>
  <div
    @click.self="options.value[name].autoClose && closeModal()"
    :class="[!modal?.active ? '__inactive' : '__active']"
    class="__modal"
  >
    <slot v-bind="modal || {}"></slot>
  </div>
</template>

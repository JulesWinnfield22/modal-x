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

const { modalName, modals, getModal } = useModal();

const name = props.name || (getCurrentInstance().parent?.type?.__name
? getCurrentInstance().parent.type.__name.split(".")[0]
: props.name)

modalName.value = name || '';

const modal = ref();
watch(
  modals,
  (modals) => {
    modal.value = getModal(name);
  },
  { deep: true, immediate: true }
);

function escListener(e) {
  if (e.key === "Escape" && modals?.length && (modal.value?.options?.closeonEsc ?? true)) {
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
    @click.self="(modal.options?.closeOnOverlayClick ?? true) && closeModal()"
    :class="[!modal?.active ? '__inactive' : '__active']"
    class="__modal"
  >
    <slot v-bind="modal || {}"></slot>
  </div>
</template>

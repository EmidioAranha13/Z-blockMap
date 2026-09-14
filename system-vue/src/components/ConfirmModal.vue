<script setup>
defineProps({
  title: { type: String, default: 'Confirmar' },
  message: { type: String, default: '' },
  cancelLabel: { type: String, default: 'Cancelar' },
  confirmLabel: { type: String, default: 'Confirmar' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits({
  cancel: null,
  confirm: null,
})
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" :aria-labelledby="'confirm-title'">
    <button type="button" class="modal__backdrop" :disabled="busy" aria-label="Fechar" @click="emit('cancel')" />
    <div class="modal__box">
      <strong id="confirm-title">{{ title }}</strong>
      <p>{{ message }}</p>
      <div class="modal__actions">
        <button type="button" class="ghost" :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button
          type="button"
          class="ok"
          :class="{ 'ok--danger': danger }"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'Aguarde…' : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: color-mix(in srgb, #000 55%, transparent);
  cursor: pointer;
}

.modal__box {
  position: relative;
  display: grid;
  gap: 12px;
  width: min(420px, 100%);
  padding: 20px 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg-panel);
  color: var(--ink);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.modal__box p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--ink-dim);
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.ghost,
.ok {
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 600;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}

.ok {
  border: 1px solid var(--brass);
  background: var(--brass);
  color: #1a1a1a;
}

.ok--danger {
  border-color: var(--danger);
  background: var(--danger);
  color: #fff;
}

.ghost:disabled,
.ok:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>

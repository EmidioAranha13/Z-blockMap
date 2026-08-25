<script setup>
/**
 * ScalePanel.vue
 *
 * Escala X × Y. O cadeado (antes dos campos) força Y = X e desabilita Y.
 */
import padlockLocked from '@/assets/padlock1.png'
import padlockOpen from '@/assets/padlock2.png'

const scaleInput = defineModel('scaleInput', { required: true })
const locked = defineModel('locked', { type: Boolean, default: false })

defineProps({
  currentWidth: { type: Number, required: true },
  currentHeight: { type: Number, required: true },
})

const emit = defineEmits({
  apply: null,
  field: null,
})

/**
 * Atualiza X ou Y. Com o cadeado, o pai espelha X em Y.
 * @param {'x' | 'y'} axis
 * @param {Event} event
 */
function onChange(axis, event) {
  emit('field', { axis, value: Number(event.target.value) })
}
</script>

<template>
  <section class="scale" aria-label="Escala do mapa">
    <header class="scale__head">
      <span class="scale__kicker">Escala</span>
      <h2>Blocos do mapa</h2>
      <p>
        Informe X (colunas) e Y (linhas). O mapa atual tem
        {{ currentWidth }} × {{ currentHeight }}.
      </p>
    </header>

    <div class="scale__fields">
      <button
        type="button"
        class="lock"
        :class="{ 'lock--on': locked }"
        :title="locked ? 'Destravar eixos (X e Y independentes)' : 'Travar eixos (Y = X)'"
        :aria-pressed="locked"
        @click="locked = !locked"
      >
        <img
          class="lock__icon"
          :src="locked ? padlockLocked : padlockOpen"
          alt=""
        />
      </button>
      <label class="field">
        <span>X — colunas</span>
        <input
          type="number"
          min="1"
          max="500"
          :value="scaleInput.x"
          @input="onChange('x', $event)"
        />
      </label>
      <span class="times" aria-hidden="true">×</span>
      <label class="field">
        <span>Y — linhas</span>
        <input
          type="number"
          min="1"
          max="500"
          :value="scaleInput.y"
          :disabled="locked"
          @input="onChange('y', $event)"
        />
      </label>
    </div>

    <button class="apply" type="button" @click="emit('apply')">
      Criar mapa
    </button>
  </section>
</template>

<style scoped>
.scale {
  display: grid;
  gap: 14px;
}

.scale__kicker {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}

.scale__head h2 {
  margin: 4px 0 6px;
  font-size: 1.05rem;
  font-weight: 650;
}

.scale__head p {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
  line-height: 1.45;
}

.scale__fields {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.field {
  display: grid;
  gap: 6px;
  flex: 1;
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.field input {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 1rem;
}

.field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.times {
  padding-bottom: 10px;
  color: var(--brass);
  font-size: 1.1rem;
}

.lock {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
}

.lock--on {
  border-color: var(--brass);
  background: var(--tool-on);
}

.lock__icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.apply {
  border: 0;
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--brass);
  color: #1a150c;
  font-weight: 700;
}

.apply:hover {
  filter: brightness(1.08);
}
</style>

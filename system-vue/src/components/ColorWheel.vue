<script setup>
/**
 * ColorWheel.vue
 *
 * Envelope Vue da biblioteca iro.js: uma roda HSV + slider de brilho.
 * O arrasto só atualiza o hex de preview. Quem grava no histórico é o
 * botão "Adicionar esta cor" da paleta.
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import iro from '@jaames/iro'

const props = defineProps({
  /** Hex atual da roda (#rrggbb). */
  hex: { type: String, required: true },
})

const emit = defineEmits({
  'update:hex': (value) => typeof value === 'string',
})

const mountRef = ref(null)
/** Instância do picker; não é reativa de propósito. */
let picker = null
/** Evita loop quando o Vue empurra um hex que o próprio picker gerou. */
let syncing = false

onMounted(() => {
  picker = new iro.ColorPicker(mountRef.value, {
    width: 208,
    color: props.hex || '#c4a35a',
    borderWidth: 1,
    borderColor: '#888',
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, options: { sliderType: 'value' } },
    ],
  })

  picker.on('color:change', (color) => {
    if (syncing) return
    emit('update:hex', color.hexString)
  })
})

onUnmounted(() => {
  picker = null
})

watch(
  () => props.hex,
  (hex) => {
    if (!picker || !hex) return
    if (picker.color.hexString.toLowerCase() === hex.toLowerCase()) return
    syncing = true
    picker.color.hexString = hex
    syncing = false
  },
)
</script>

<template>
  <div ref="mountRef" class="wheel" aria-label="Roda de cores" />
</template>

<style scoped>
.wheel {
  display: flex;
  justify-content: center;
}
</style>

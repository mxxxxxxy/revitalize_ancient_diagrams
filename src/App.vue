<script setup>
// import { RouterLink, RouterView } from 'vue-router'
import TreeView from '@/components/Tree.vue'
import { onMounted, ref } from 'vue';

const mode = ref('ancient')


</script>

<template>
  <div style="display: flex; flex-direction: column; width: 500px; height: 100vh;">
    <div class="btn" @click="mode = (mode === 'modern' ? 'ancient' : 'modern')">Change</div>
    <TreeView :mode="mode"></TreeView>
  </div>
</template>

<style scoped>
.btn {
    cursor: pointer;
    border: 1px solid black;
    width: 80px;
    height: 30px;
    justify-content: center;
    align-items: center;
    border-radius: 5px;
    display: flex;
}
</style>

<script setup>
// import { RouterLink, RouterView } from 'vue-router'
import TreeView from '@/components/Tree.vue'
import NodeView from '@/components/Nodelink.vue'
import { ref } from 'vue'

const mode = ref('ancient')
const mode2 = ref('ancient')


</script>

<template>
  <div style="display: flex; flex-direction: column; width: 500px; height: 100vh;">
    <div class="btn" @click="mode = (mode === 'modern' ? 'ancient' : 'modern')">Change</div>
    <div class="btn" @click="mode2 = (mode2 === 'modern' ? 'ancient' : 'modern')">Change2</div>
    <TreeView :mode="mode" data="sishi" :width="800"></TreeView>
  </div>
  <NodeView style="position: absolute; right: 10px; top: 10px;" :mode="mode2" data="node" :width="700"></NodeView>
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

<script setup>
const width = ref(400);
const height = ref(0);

</script>

<template>
    <div class="node-link-container" :style="{width: width + 'px', height: height + 'px', position: 'relative'}">
        <div ref="canvas" style="position: absolute; left: 0; top: 0;"></div>
    </div>
</template>


<style scope>

</style>
<script setup lang="ts">
import { TextAttributes } from "@opentui/core";
</script>

<template>
  <boxRenderable alignItems="center" justifyContent="center" flexGrow="1">
    <boxRenderable justifyContent="center" alignItems="flex-end">
      <asciiFontRenderable font="tiny" text="OpenTUI" />
      <textRenderable :attributes="TextAttributes.DIM">
        What will you build?
      </textRenderable>
    </boxRenderable>
  </boxRenderable>
</template>

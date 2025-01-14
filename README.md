Modal-X
=
**This Vue Plugin provides a simple and flexible way to create modals for your web applications using a file-based approach. Easily define modal content in separate files, allowing for better organization and maintainability with minimal effort.**

## Installation

```sh
npm install @customizer/modal-x
```

## Usage
> :warning:  *Modal-X* Only Works with `Vue3` Project With `Vite`

**Modal-X** scans you project (files inside the `./src` folder) for files that end with `*.mdl.vue` `*.amdl.vue` and uses them as your modal boxs.

in your `src/main.js or main.ts` file
```js
import modal from '@customizer/modal-x'
import { createApp } from 'vue'

import App from './App.vue'

const app = createApp(App)

app.use(modal)
app.mount('#app')
```

when using with `NUXT` do this:

in you `plugins` folder create a file `modalx-plugin.ts` or any name you like

in your `plugins/modalx-plugin.ts` file

```js
import modal from '@customizer/modal-x'

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.use(modal)
})
```

and in your `nuxt.config.ts` file
```js
plugins: [
  ...
  // only on the client
  { src: '~/plugins/modalx-plugin', mode: 'client' }, 
  ...
]
```
**with that you are ready to start using it.**

then create a modal file anywhere inside the `./src` folder. lets say inside the components folder `./src/components/Confirmation.mdl.vue`
```html
// src/componetns/Confirmation.mdl.vue
<script setup>
  import { closeModal } from '@customizer/modal-x'
</script>

<template>
  <div class='inset-0 h-full w-full bg-black/50 grid place-items-center' >
    <div class='rounded-md p-3 bg-white text-gray-700' >
      <p>Are You Sure?</p> 
      <div class='mt-4 border-t flex p-1 items-center justify-end gap-2' >
        <button class="border px-4 rounded-md" @click='closeModal(false)' >no</button>
        <button class="border px-4 rounded-md" @click='closeModal(true)' >yes</button>
      </div>
    </div>
  </div>
</template>
```

we have our first modal so now lets load it. from any where in your project. lets say `App.vue`

```html
<script setup>
import { openModal } from '@customizer/modal-x'

function confirmToDelete() {
  openModal('Confirmation', {}, response => {
    // response will be anything you passed 
    // to closeModal(true or false) from the
    // Confirmation.mdl.vue Modal
    if(!response) return
    
    // [TODO] delete 
  })
}
</script>

<template>
  <button @click="confirmToDelete" >Open</button>
</template>
```
:tada: congratulation that's all there is to it

> **Note:** Most of the time when I use **Modal-X** I forget the exact names of the files. So, I have a small script that I wrote to help with the autocomplete of the file names. To use it, run: 
```sh 
npx watchmodal 
```
> This will scan your project for modal files and assist with writing the file names when opening the modals.

![Autocomplete File Names](https://i.ibb.co/8rH12rC/filenames-autocomplete.png)

## Types Of Modals (`*.mdl.vue` and `*.amdl.vue`)
### `*.mdl.vue` files
This type of modal files are loaded with the rest of the project and stored in a `pinia` store 

### `*.amdl.vue` files
this types of modal files are not loaded with the rest of the project. they are loaded lazily, only when needed or when `openModal` is called.

when using a `*.amdl.vue` file you will see a loading component that shows a spinner untill the component is loaded.

### Other Files Types (`*.g.vue`, `*.s.vue`)
### `*.g.vue` files
The `g` stands global which you can create and it will replace the loading component that is shown when any `*.amdl.vue` file is being loaded

> **Note** There should be only one `*.g.vue` file in your project

### `*.s.vue` files
This types of files are used just like the `*.g.vue` file but are more specific. lets say for examle you have a `UserForm.amdl.vue` modal. and if you want so show a loading `skeleton` utill the component is loaded, you can use the `*.s.vue` file for this: `UserForm.s.vue`

but this may not be ideal if you have many `Forms` with some sharing the same loading `skeleton` and other having their own so you dont want to repeat the `skeleton` for every file so you can group them so like this: 
`Form.skl.amdl.vue`, `Form2.skl.amdl.vue` this files both share a `skeleton` named `*.skl.s.vue`


**So the `[name].s.vue` files that have a direct relation will take precedence over the `*.[group name].s.vue*` and `*.g.vue` files**

## Passing Data to and from a modal
when you open a modal with `openModal(filename)` you can pass data and get back a reponse from the opened modal.

you can pass data to a modal using the `openModal` function and the modal will get the data as a prop named `data` 

```html
<!-- App.vue -->
<script setup >
  ...
  openModal('Confirmation', {
    message: 'Are you sure you want to delete this?'
  }, response => {
      if(!response) return
      // [TODO] delete 
  })
  ...
</script>

<!-- src/components/Confirmation.mdl.vue` -->
<script setup>
  import { closeModal } from '@customizer/modal-x'

  const props = defineProps({
    data: {
      type: Object,
    }
  })
</script>

<template>
  <div class='inset-0 h-full w-full bg-black/50 grid place-items-center' >
    <div class='rounded-md p-3 bg-white text-gray-700' >
      <p>{{ data?.message ? data?.message : "Are You Sure?"}}</p> 
      ...
    </div>
  </div>
</template>
```

and when ever you call `closeModal` and pass any data to it the component/function that opened the modal will get that data back from the opened modal.

## APIS
LOADING ...

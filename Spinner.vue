<template>
  <div class="spinner-wrapper">
    <div class="border-l border-gray-300 right-0 h-full w-[30rem] flex bg-form-modal-clr justify-center items-center"> 
      <div class='spiner-parent'>
        <div class='spiner-child'></div>
      </div>
    </div>
  </div>
</template>

<style>
  .spinner-wrapper {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background-color: #0005;
  }

	.spiner-parent {
    inset: 0;
    width: 3rem;
    height: 3rem;
    padding: 2px;
    background-image: linear-gradient(180deg, #0005, #0005 50%, white 50%);
    border-radius: 5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    animation: spin 1s linear infinite;
  }

  .spiner-child {
    width: 100%;
    height: 100%;
    background-color: white;
    border-radius: 50%;
    border: 1px solid #0003 
  }

  @keyframes spin {
    to {
      rotate: 360deg
    }
  }
</style>
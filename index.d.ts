import { Component, Plugin } from "vue"
import { FileNames } from "./FileNameEnums"

interface ModalOptions {
	autoClose?: boolean,
}

type ModalCallback<T> = (response: T) => void 

interface Modal<T extends any, D extends any> {
	filename: string,
	data: D,
	cb: ModalCallback<T>
}

interface Spinner {
	id: string,
	modal: Component,
	group: string
}

interface FetchedModals {
	id: string,
	modal: Component
}

declare module '@customizer/modal-x' {
	/**
	 * 
	 */
	export function useModal<T extends any>(): ({
		getModal: <T, D extends any>(filename: FileNames) => Modal<T, D>,
		modals: Modal[],
		spinners: Spinner[],
		openModal: <T extends any , D extends any>(filename: FileNames, data?: D, cb?: ModalCallback<T>) =>  void 
    closeModal: (data?: any) => void
		fetchedModals: FetchedModals[],
		getModal: (filename: FileNames) => Modal
	});

	export function getModal(filename: FileNames): Modal

	export function openModal<T extends any , D extends any>(filename: FileNames, data?: D, cb?: ModalCallback<T>): void 

	export function closeModal(data?: any): void

	export function modalOptions(options: ModalOptions): Proxy<ModalOptions>;

	export const ModalParent: Component

	const modal: Plugin
	export default modal
}
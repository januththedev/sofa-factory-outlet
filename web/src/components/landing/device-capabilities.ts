type DeviceCapabilities = {
  finePointer: boolean;
  hasTouch: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
};

/** Missing hardware hints are allowed; an explicit low-end hint always wins. */
export function shouldUse3d(device: DeviceCapabilities): boolean {
  if (!device.finePointer || device.hasTouch) return false;
  if (device.hardwareConcurrency !== undefined && device.hardwareConcurrency <= 4) return false;
  if (device.deviceMemory !== undefined && device.deviceMemory <= 4) return false;
  return true;
}

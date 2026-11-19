let counter = 0;

export function loadPhoto(url, name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      counter += 1;
      resolve({
        id: `photo-${Date.now()}-${counter}`,
        name,
        url,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        local: url.startsWith('blob:'),
      });
    };
    image.onerror = () => reject(new Error(`Could not load ${name}`));
    image.src = url;
  });
}

export function sampleUrl(name) {
  const safe = String(name || 'pier').replace(/[^a-z0-9_-]/gi, '');
  return new URL(`../samples/${safe}.jpg`, import.meta.url).href;
}

export function filePhoto(file, index) {
  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, '') || `photo ${index + 1}`;
  return loadPhoto(url, name);
}

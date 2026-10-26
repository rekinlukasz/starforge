// Small glTF 2.0 binary (GLB) builder used by tools/build-models.mjs.
// Supports indexed triangle primitives with POSITION / NORMAL / COLOR_0 /
// TEXCOORD_0, PBR or unlit materials, embedded PNG textures and a node tree.
// UVs are given in three.js convention (v up) and flipped to glTF (v down).

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

export class GltfBuilder {
  constructor(generator = 'Starforge tools/build-models.mjs') {
    this.json = {
      asset: { version: '2.0', generator },
      scene: 0,
      scenes: [{ name: 'Scene', nodes: [] }],
      nodes: [], meshes: [], materials: [], buffers: [{ byteLength: 0 }],
      bufferViews: [], accessors: [],
    };
    this.chunks = [];
    this.offset = 0;
    this.extensions = new Set();
  }

  view(bytes, target) {
    const pad = (4 - (bytes.length % 4)) % 4;
    this.chunks.push(bytes, new Uint8Array(pad));
    const bv = { buffer: 0, byteOffset: this.offset, byteLength: bytes.length };
    if (target) bv.target = target;
    this.json.bufferViews.push(bv);
    this.offset += bytes.length + pad;
    return this.json.bufferViews.length - 1;
  }

  accessor(typed, target, desc) {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    this.json.accessors.push({ bufferView: this.view(bytes, target), ...desc });
    return this.json.accessors.length - 1;
  }

  // PNG bytes -> texture index (with a repeat/linear sampler).
  texture(png, { wrapS = 10497, wrapT = 33071 } = {}) {
    const j = this.json;
    j.images ??= [];
    j.textures ??= [];
    j.samplers ??= [];
    j.images.push({ bufferView: this.view(new Uint8Array(png), undefined), mimeType: 'image/png' });
    j.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS, wrapT });
    j.textures.push({ source: j.images.length - 1, sampler: j.samplers.length - 1 });
    return j.textures.length - 1;
  }

  material(def) {
    if (def.extensions?.KHR_materials_unlit) this.extensions.add('KHR_materials_unlit');
    this.json.materials.push(def);
    return this.json.materials.length - 1;
  }

  // stream: { positions, normals, colors?, uvs?, indices } (plain arrays)
  primitive(stream, material) {
    const pos = new Float32Array(stream.positions);
    const count = pos.length / 3;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
    }
    const attributes = {
      POSITION: this.accessor(pos, ARRAY_BUFFER, { componentType: 5126, count, type: 'VEC3', min, max }),
      NORMAL: this.accessor(new Float32Array(stream.normals), ARRAY_BUFFER, { componentType: 5126, count, type: 'VEC3' }),
    };
    if (stream.colors) attributes.COLOR_0 = this.accessor(new Float32Array(stream.colors), ARRAY_BUFFER, { componentType: 5126, count, type: 'VEC3' });
    if (stream.uvs) {
      const uv = new Float32Array(stream.uvs);
      for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i]; // three (v up) -> glTF (v down)
      attributes.TEXCOORD_0 = this.accessor(uv, ARRAY_BUFFER, { componentType: 5126, count, type: 'VEC2' });
    }
    const big = count > 65535;
    const idx = big ? new Uint32Array(stream.indices) : new Uint16Array(stream.indices);
    return {
      attributes,
      indices: this.accessor(idx, ELEMENT_ARRAY_BUFFER, { componentType: big ? 5125 : 5123, count: idx.length, type: 'SCALAR' }),
      material,
    };
  }

  mesh(name, primitives) {
    this.json.meshes.push({ name, primitives });
    return this.json.meshes.length - 1;
  }

  // node: { name, mesh?, children?, extras?, translation?, rotation?, scale? }; root adds it to the scene.
  node(node, { root = false } = {}) {
    this.json.nodes.push(node);
    const index = this.json.nodes.length - 1;
    if (root) this.json.scenes[0].nodes.push(index);
    return index;
  }

  encode() {
    const j = this.json;
    j.buffers[0].byteLength = this.offset;
    if (this.extensions.size) j.extensionsUsed = [...this.extensions];
    const jsonBytes = new TextEncoder().encode(JSON.stringify(j));
    const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
    const jsonChunk = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
    jsonChunk.set(jsonBytes);
    const bin = new Uint8Array(this.offset);
    let p = 0;
    for (const c of this.chunks) { bin.set(c, p); p += c.length; }
    const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); // 'glTF'
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    dv.setUint32(12, jsonChunk.length, true);
    dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
    out.set(jsonChunk, 20);
    const binStart = 20 + jsonChunk.length;
    dv.setUint32(binStart, bin.length, true);
    dv.setUint32(binStart + 4, 0x004e4942, true); // 'BIN\0'
    out.set(bin, binStart + 8);
    return out;
  }
}

"""A BiRefNet session tuned to fit a machine with little free memory."""
import onnxruntime as ort
from rembg import new_session


def low_memory_session(model="birefnet-general-lite", threads=2):
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False   # free buffers as soon as a layer is done
    opts.enable_mem_pattern = False     # no pre-planned (large) allocation for the whole graph
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = 1
    return new_session(model, sess_opts=opts)


if __name__ == "__main__":
    import sys, time
    from PIL import Image, ImageOps
    from rembg import remove
    model, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    session = low_memory_session(model)
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    img.thumbnail((1600, 1600))
    start = time.time()
    cut = remove(img, session=session)
    bg = Image.new("RGB", img.size, (240, 236, 228)); bg.paste(cut, (0, 0), cut)
    sheet = Image.new("RGB", (img.width * 2, img.height)); sheet.paste(img, (0, 0)); sheet.paste(bg, (img.width, 0))
    sheet.save(dst, quality=80)
    print(f"{model}: {time.time() - start:.1f}s", flush=True)

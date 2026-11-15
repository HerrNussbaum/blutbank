let render = () => '';

export function setCardFaceRenderer(callback) {
  render = callback;
}

export function previewCardFace(card) {
  return render(card);
}

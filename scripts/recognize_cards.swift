import Foundation
import Vision
import ImageIO
// Offline OCR. Coordinates are normalized, with y measured from the top.
for path in CommandLine.arguments.dropFirst() {
    autoreleasepool {
        do {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US", "de-DE"]
            request.usesLanguageCorrection = false
            request.minimumTextHeight = 0.004
            let handler = VNImageRequestHandler(url: URL(fileURLWithPath:path))
            try handler.perform([request])
            let lines: [[String:Any]] = (request.results ?? []).compactMap { item in
                guard let candidate = item.topCandidates(1).first else {return nil}
                let box = item.boundingBox
                return ["text": candidate.string, "confidence": candidate.confidence,
                        "x":box.minX, "y":1-box.maxY, "width":box.width, "height":box.height]
            }
            let result: [String:Any] = ["image":path,"lines":lines]
            let data = try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
            let id = URL(fileURLWithPath:path).deletingPathExtension().lastPathComponent
            try data.write(to: URL(fileURLWithPath:".cache/card-ocr/\(id).json"))
            print(id)
        } catch { fputs("\(error)\n", stderr) }
    }
}

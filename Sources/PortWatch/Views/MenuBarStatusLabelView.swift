import AppKit
import SwiftUI

struct MenuBarStatusLabelView: View {
    @ObservedObject var store: PortWatchStore

    var body: some View {
        HStack(spacing: 4) {
            menuBarImage
                .resizable()
                .scaledToFit()
                .frame(width: 14, height: 14)

            if store.visiblePortCount > 0 {
                Text("\(min(store.visiblePortCount, 99))")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
            }
        }
    }

    private var menuBarImage: Image {
        if
            let url = Bundle.main.url(forResource: "portwatch-icon", withExtension: "png"),
            let image = NSImage(contentsOf: url)
        {
            image.isTemplate = true
            return Image(nsImage: image)
        }

        return Image(systemName: "dot.radiowaves.left.and.right")
    }
}

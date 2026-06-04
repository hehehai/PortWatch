import AppKit
import SwiftUI

struct MenuBarStatusLabelView: View {
    var body: some View {
        menuBarImage
            .frame(width: 17, height: 17)
    }

    private var menuBarImage: Image {
        if
            let url = Bundle.main.url(forResource: "menu-bar-icon", withExtension: "png"),
            let image = NSImage(contentsOf: url)
        {
            image.isTemplate = true
            image.size = NSSize(width: 17, height: 17)
            return Image(nsImage: image)
        }

        return Image(systemName: "dot.radiowaves.left.and.right")
    }
}

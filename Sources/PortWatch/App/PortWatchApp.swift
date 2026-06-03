import AppKit
import SwiftUI

private enum WindowChrome {
    static let contentWidth: CGFloat = 360
    static let contentHeight: CGFloat = 560
    static let trafficLightTopInset: CGFloat = 18
    static let trafficLightLeadingInset: CGFloat = 18
    static let trafficLightSpacing: CGFloat = 6
}

@main
struct PortWatchApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var settingsStore: PortWatchSettingsStore
    @StateObject private var store: PortWatchStore
    @StateObject private var updater: AppUpdater

    init() {
        let settingsStore = PortWatchSettingsStore()
        _settingsStore = StateObject(wrappedValue: settingsStore)
        _store = StateObject(wrappedValue: PortWatchStore(settingsStore: settingsStore))
        _updater = StateObject(wrappedValue: AppUpdater())
    }

    var body: some Scene {
        WindowGroup(id: "main") {
            ContentView(
                store: store,
                settingsStore: settingsStore,
                updater: updater
            )
                .frame(width: WindowChrome.contentWidth, height: WindowChrome.contentHeight)
                .task {
                    store.start()
                }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: WindowChrome.contentWidth, height: WindowChrome.contentHeight)
        .windowResizability(.contentSize)
        .commands {
            CommandMenu("Ports") {
                Button("Refresh Now") {
                    Task {
                        await store.refresh(reason: .manual)
                    }
                }
                .keyboardShortcut("r")

                Button("Terminate Selected Process") {
                    store.requestTerminationForSelectedProcess()
                }
                .keyboardShortcut(.delete, modifiers: [.command])
                .disabled(store.selectedRecord == nil || store.isKilling)
            }
        }

        MenuBarExtra {
            MenuBarPanelView(
                store: store,
                settingsStore: settingsStore,
                updater: updater
            )
        } label: {
            MenuBarStatusLabelView(store: store)
        }
        .menuBarExtraStyle(.window)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async {
            self.configureWindow()
        }
    }

    @MainActor
    private func configureWindow() {
        guard let window = NSApp.windows.first else {
            return
        }

        let contentSize = NSSize(width: WindowChrome.contentWidth, height: WindowChrome.contentHeight)
        window.styleMask.insert(.fullSizeContentView)
        window.setContentSize(contentSize)
        window.minSize = contentSize
        window.maxSize = contentSize
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.isMovableByWindowBackground = true

        guard
            let closeButton = window.standardWindowButton(.closeButton),
            let miniButton = window.standardWindowButton(.miniaturizeButton),
            let zoomButton = window.standardWindowButton(.zoomButton),
            let buttonContainer = closeButton.superview
        else {
            return
        }

        let buttons = [closeButton, miniButton, zoomButton]
        let startX = WindowChrome.trafficLightLeadingInset
        let spacing = WindowChrome.trafficLightSpacing
        let y = buttonContainer.frame.height - closeButton.frame.height - WindowChrome.trafficLightTopInset

        for (index, button) in buttons.enumerated() {
            let origin = NSPoint(
                x: startX + CGFloat(index) * (button.frame.width + spacing),
                y: y
            )
            button.setFrameOrigin(origin)
        }
    }
}

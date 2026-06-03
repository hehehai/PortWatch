import Combine
import Foundation
import Sparkle

@MainActor
final class AppUpdater: ObservableObject {
    @Published private(set) var isConfigured = false
    @Published private(set) var canCheckForUpdates = false
    @Published private(set) var statusMessage = "Updates are unavailable until Sparkle feed settings are configured."

    let updaterController: SPUStandardUpdaterController
    private var cancellable: AnyCancellable?

    init() {
        updaterController = SPUStandardUpdaterController(
            startingUpdater: false,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )

        cancellable = updaterController.updater.publisher(for: \.canCheckForUpdates)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] canCheck in
                self?.canCheckForUpdates = canCheck
            }

        startIfConfigured()
    }

    var updater: SPUUpdater {
        updaterController.updater
    }

    func startIfConfigured() {
        let feedURL = Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") as? String
        let publicKey = Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String

        guard
            let feedURL, !feedURL.isEmpty,
            let publicKey, !publicKey.isEmpty
        else {
            isConfigured = false
            canCheckForUpdates = false
            statusMessage = "Set SUFeedURL and SUPublicEDKey to enable Sparkle updates."
            return
        }

        updaterController.startUpdater()
        isConfigured = true
        statusMessage = "Sparkle updater is configured."
    }

    func checkForUpdates() {
        guard isConfigured, canCheckForUpdates else {
            return
        }
        updaterController.checkForUpdates(nil)
    }
}

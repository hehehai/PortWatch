import Foundation

@MainActor
final class PortWatchSettingsStore: ObservableObject {
    @Published private(set) var preferences: PortWatchPreferences

    private let userDefaults: UserDefaults
    private let storageKey = "PortWatch.preferences"

    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults

        if let data = userDefaults.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode(PortWatchPreferences.self, from: data) {
            self.preferences = decoded
        } else {
            self.preferences = .default
        }
    }

    func selectRefreshProfile(_ profile: RefreshProfile) {
        preferences.selectedRefreshProfile = profile
        persist()
    }

    func updateLiveRefreshInterval(_ interval: Double) {
        preferences.liveRefreshInterval = max(interval, 0.5)
        persist()
    }

    func updateNormalRefreshInterval(_ interval: Double) {
        preferences.normalRefreshInterval = max(interval, 1)
        persist()
    }

    func addPortRange() {
        preferences.monitoredPortRanges.append(PortRange(lowerBound: 0, upperBound: 10_000))
        persist()
    }

    func removePortRange(id: UUID) {
        preferences.monitoredPortRanges.removeAll { $0.id == id }
        if preferences.monitoredPortRanges.isEmpty {
            preferences.monitoredPortRanges = [PortRange(lowerBound: 0, upperBound: 65_535)]
        }
        persist()
    }

    func updatePortRange(id: UUID, lowerBound: Int? = nil, upperBound: Int? = nil) {
        guard let index = preferences.monitoredPortRanges.firstIndex(where: { $0.id == id }) else {
            return
        }

        if let lowerBound {
            preferences.monitoredPortRanges[index].lowerBound = max(0, min(lowerBound, 65_535))
        }

        if let upperBound {
            preferences.monitoredPortRanges[index].upperBound = max(0, min(upperBound, 65_535))
        }

        persist()
    }

    func refreshInterval(for profile: RefreshProfile) -> Duration {
        let seconds = profile == .live ? preferences.liveRefreshInterval : preferences.normalRefreshInterval
        return .milliseconds(Int64(seconds * 1000))
    }

    func monitors(port: Int) -> Bool {
        preferences.monitoredPortRanges.contains { $0.contains(port) }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(preferences) {
            userDefaults.set(data, forKey: storageKey)
        }
    }
}

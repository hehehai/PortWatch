import Foundation

enum RefreshProfile: String, CaseIterable, Codable, Sendable {
    case live
    case normal

    var title: String {
        switch self {
        case .live:
            return "Live"
        case .normal:
            return "Normal"
        }
    }
}

struct PortRange: Identifiable, Hashable, Codable, Sendable {
    var id: UUID
    var lowerBound: Int
    var upperBound: Int

    init(id: UUID = UUID(), lowerBound: Int, upperBound: Int) {
        self.id = id
        self.lowerBound = lowerBound
        self.upperBound = upperBound
    }

    var normalizedLowerBound: Int {
        min(lowerBound, upperBound)
    }

    var normalizedUpperBound: Int {
        max(lowerBound, upperBound)
    }

    func contains(_ port: Int) -> Bool {
        normalizedLowerBound...normalizedUpperBound ~= port
    }
}

struct PortWatchPreferences: Codable, Sendable {
    var selectedRefreshProfile: RefreshProfile
    var liveRefreshInterval: Double
    var normalRefreshInterval: Double
    var monitoredPortRanges: [PortRange]

    static let `default` = PortWatchPreferences(
        selectedRefreshProfile: .normal,
        liveRefreshInterval: 1,
        normalRefreshInterval: 5,
        monitoredPortRanges: [
            PortRange(lowerBound: 0, upperBound: 65_535),
        ]
    )
}

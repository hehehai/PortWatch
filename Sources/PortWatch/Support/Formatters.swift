import Foundation

enum PortWatchFormatters {
    static func uptime(_ value: TimeInterval?) -> String {
        guard let value else {
            return "Unavailable"
        }

        let seconds = max(Int(value), 0)
        let days = seconds / 86_400
        let hours = (seconds % 86_400) / 3_600
        let minutes = (seconds % 3_600) / 60

        if days > 0 {
            return "\(days)d \(hours)h"
        }
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        if minutes > 0 {
            return "\(minutes)m"
        }
        return "\(seconds)s"
    }

    static func timestamp(_ value: Date?) -> String {
        guard let value else {
            return "Unavailable"
        }
        return value.formatted(date: .abbreviated, time: .standard)
    }

    static func relativeUpdate(_ value: Date?) -> String {
        guard let value else {
            return "Never"
        }
        return value.formatted(.relative(presentation: .named))
    }

    static func summaryTimestamp(_ value: Date?) -> String {
        guard let value else {
            return "Never"
        }
        return value.formatted(date: .omitted, time: .shortened)
    }

    static func condensedPath(_ value: String) -> String {
        let homeDirectory = NSHomeDirectory()
        if value.hasPrefix(homeDirectory) {
            return value.replacingOccurrences(of: homeDirectory, with: "~")
        }
        return value
    }
}

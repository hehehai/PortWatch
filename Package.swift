// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PortWatch",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "PortWatchKit",
            targets: ["PortWatchKit"]
        ),
        .executable(
            name: "PortWatch",
            targets: ["PortWatch"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.2"),
    ],
    targets: [
        .target(
            name: "PortWatchKit",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/PortWatch"
        ),
        .executableTarget(
            name: "PortWatch",
            dependencies: [
                "PortWatchKit",
            ],
            path: "Sources/PortWatchLauncher"
        ),
    ]
)

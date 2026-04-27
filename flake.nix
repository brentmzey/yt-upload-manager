{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, nixpkgs-unstable, rust-overlay }:
    let
      system = "aarch64-darwin";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ 
          (import rust-overlay) 
          (final: prev: {
            # Emergency stub for removed legacy SDKs
            apple_sdk_11_0 = final.darwin.apple_sdk;
            apple_sdk_12_3 = final.darwin.apple_sdk;
            darwin = prev.darwin // {
              apple_sdk_11_0 = final.darwin.apple_sdk;
              apple_sdk_12_3 = final.darwin.apple_sdk;
            };
          })
        ];
      };
      unstable = import nixpkgs-unstable { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShellNoCC {
        buildInputs = with pkgs; [
          (rust-bin.stable.latest.default.override { extensions = [ "rust-src" ]; })
          nodejs_22
          bun
          unstable.pocketbase
          pkg-config
          libiconv
          darwin.apple_sdk.frameworks.Security
          darwin.apple_sdk.frameworks.CoreServices
          darwin.apple_sdk.frameworks.WebKit
        ];

        shellHook = ''
          export SDKROOT=$(xcrun --show-sdk-path)
          echo "🚀 Nix Environment with Bun Ready"
        '';
      };
    };
}
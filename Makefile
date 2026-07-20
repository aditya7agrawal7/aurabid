.PHONY: build test clean fmt

build:
	cargo build --target wasm32v1-none --release

test:
	cargo test

clean:
	cargo clean

fmt:
	cargo fmt

.PHONY: check
check:
	cargo check

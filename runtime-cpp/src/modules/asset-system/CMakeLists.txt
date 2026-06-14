add_library(artcade-asset-system
    src/asset-loader.cpp
    src/asset-manifest-index.cpp
    src/zip-reader.cpp        # Phase 17: ZIP reader for .artcade archives
    src/artcade-crypto.cpp    # Phase 20: XChaCha20-Poly1305 archive decryption
)
target_include_directories(artcade-asset-system
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-asset-system
    PUBLIC  artcade-core artcade-object-type-materialize artcade-project-json
)

# Asset decryption: link Monocypher and the build-time key header when present.
# Without it, artcade-crypto compiles as a passthrough (plaintext archives only).
if(ARTCADE_HAS_CRYPTO)
    target_link_libraries(artcade-asset-system PRIVATE monocypher)
    target_include_directories(artcade-asset-system PRIVATE ${ARTCADE_GENERATED_INCLUDE_DIR})
    target_compile_definitions(artcade-asset-system PRIVATE ARTCADE_HAS_CRYPTO=1)
endif()

# When raylib is present, expose raylib/src for sinfl.h (DEFLATE decompressor)
# and link raylib so sinflate() (compiled in rcore.c) is available at link time.
if(TARGET raylib)
    target_include_directories(artcade-asset-system PRIVATE
        ${CMAKE_SOURCE_DIR}/libs/raylib/src      # → #include "external/sinfl.h"
    )
    target_link_libraries(artcade-asset-system PRIVATE raylib)
endif()

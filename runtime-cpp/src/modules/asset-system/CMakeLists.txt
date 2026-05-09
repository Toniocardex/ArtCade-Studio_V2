add_library(artcade-asset-system
    src/asset-loader.cpp
    src/asset-cache.cpp
)
target_include_directories(artcade-asset-system
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-asset-system
    PUBLIC  artcade-core
    # PRIVATE miniz (or libzip) for .artcade ZIP extraction
)

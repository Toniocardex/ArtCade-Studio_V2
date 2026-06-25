add_library(artcade-renderer
    src/renderer.cpp
    src/sprite-outline-shader.cpp
    src/texture-cache.cpp
    src/font-cache.cpp
)
target_include_directories(artcade-renderer
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-renderer
    PUBLIC  artcade-core artcade-presentation
    PRIVATE raylib
)

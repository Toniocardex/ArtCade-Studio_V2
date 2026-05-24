add_library(artcade-input
    src/input.cpp
    src/keymap.cpp
)
target_include_directories(artcade-input
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-input
    PUBLIC  artcade-core
    PRIVATE raylib
)

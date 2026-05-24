add_library(artcade-sprite-animator
    src/sprite-animator.cpp
)
target_include_directories(artcade-sprite-animator
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-sprite-animator
    PUBLIC artcade-core
)

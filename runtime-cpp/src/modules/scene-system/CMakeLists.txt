add_library(artcade-scene-system
    src/scene-manager.cpp
)
target_include_directories(artcade-scene-system
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-scene-system
    PUBLIC  artcade-core
)

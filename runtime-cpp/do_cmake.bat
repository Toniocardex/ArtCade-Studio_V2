@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp\cmake_out.txt" 2>&1
cd /d "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp"
cmake -S . -B build-phase4 -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release -DARTCADE_BUILD_TESTS=ON >> "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp\cmake_out.txt" 2>&1
echo CMAKE_EXIT=%ERRORLEVEL% >> "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp\cmake_out.txt"
